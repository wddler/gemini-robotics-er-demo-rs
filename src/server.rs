use crate::Config;
use actix_web::{get, post, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Deserialize)]
pub struct SendRequest {
    #[serde(rename = "imageBase64")]
    pub image_base64: String,
    pub prompt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DetectionPoint {
    pub point: [u32; 2],
    pub label: String,
}

#[get("/")]
async fn index() -> impl Responder {
    let index_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("frontend/index.html");
    match fs::read_to_string(index_path) {
        Ok(body) => HttpResponse::Ok().content_type("text/html").body(body),
        Err(e) => HttpResponse::NotFound().body(format!("404 Not Found: frontend/index.html not found ({})", e)),
    }
}

async fn send_gemini(req: web::Json<SendRequest>, config: &Config) -> HttpResponse {
    let api_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return HttpResponse::BadRequest().body("GEMINI_API_KEY environment variable not set");
    }

    let client = reqwest::Client::new();
    let gemini_url = format!(
        "{}/{}/models/{}:generateContent",
        config.gemini.api_base_url, config.gemini.api_version, config.gemini.model
    );

    let gemini_request = json!({
        "contents": [
            {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "image/png",
                            "data": req.image_base64
                        }
                    },
                    {
                        "text": req.prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": config.gemini.temperature,
            "thinkingConfig": {
                "thinkingBudget": config.gemini.thinking_budget
            }
        }
    });

    match client
        .post(&gemini_url)
        .query(&[("key", api_key)])
        .json(&gemini_request)
        .send()
        .await
    {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(body) => {
                println!("Gemini response: {:?}", body);
                if let Some(text) = body
                    .get("candidates")
                    .and_then(|c| c.get(0))
                    .and_then(|f| f.get("content"))
                    .and_then(|co| co.get("parts"))
                    .and_then(|p| p.get(0))
                    .and_then(|p| p.get("text"))
                    .and_then(|t| t.as_str())
                {
                    if let Ok(parsed) = serde_json::from_str::<Vec<DetectionPoint>>(text) {
                        return HttpResponse::Ok().json(parsed);
                    }
                    return HttpResponse::Ok().body(text.to_string());
                }
                HttpResponse::InternalServerError().body("No text in response")
            }
            Err(e) => HttpResponse::InternalServerError().body(format!("Failed to parse response: {}", e)),
        },
        Err(e) => {
            println!("API error: {}", e);
            HttpResponse::InternalServerError().body(format!("Failed to call API: {}", e))
        }
    }
}

#[derive(Debug, Serialize)]
struct QwenRequest<'a> {
    model: &'a str,
    prompt: &'a str,
    stream: bool,
    images: Vec<&'a str>,
}

async fn send_qwen(req: web::Json<SendRequest>, config: &Config) -> HttpResponse {
    let client = reqwest::Client::new();
    let qwen_url = &config.qwen.api_url;

    let qwen_request = QwenRequest {
        model: &config.qwen.model,
        prompt: &req.prompt,
        stream: config.qwen.stream,
        images: vec![&req.image_base64],
    };

    match client
        .post(qwen_url)
        .json(&qwen_request)
        .send()
        .await
    {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(body) => {
                println!("Qwen response: {:?}", body);
                if let Some(response_str) = body.get("response").and_then(|r| r.as_str()) {
                    let json_part = if let Some(start) = response_str.find('[') {
                        if let Some(end) = response_str.rfind(']') {
                            &response_str[start..=end]
                        } else {
                            response_str
                        }
                    } else {
                        response_str
                    };

                    if let Ok(mut parsed) = serde_json::from_str::<Vec<DetectionPoint>>(json_part) {
                        // Qwen returns [x, y], but frontend expects [y, x]. Swap them.
                        for p in &mut parsed {
                            p.point.swap(0, 1);
                        }
                        return HttpResponse::Ok().json(parsed);
                    }
                    // If parsing fails, return the extracted or original string
                    return HttpResponse::Ok().body(json_part.to_string());
                }
                HttpResponse::InternalServerError().body("No 'response' field in qwen output")
            }
            Err(e) => HttpResponse::InternalServerError().body(format!("Failed to parse qwen response as JSON: {}", e)),
        },
        Err(e) => {
            println!("API error: {}", e);
            HttpResponse::InternalServerError().body(format!("Failed to call API: {}", e))
        }
    }
}

#[post("/send")]
async fn send(req: web::Json<SendRequest>, config: web::Data<Config>) -> impl Responder {
    match config.active_model.as_str() {
        "gemini" => send_gemini(req, config.get_ref()).await,
        "qwen" => send_qwen(req, config.get_ref()).await,
        _ => HttpResponse::InternalServerError().body(format!("Unknown model provider: {}", config.active_model)),
    }
}

#[post("/upload")]
async fn upload(req: HttpRequest, body: web::Bytes) -> impl Responder {
    let ct = req
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream");
    let ext = if ct.contains("png") {
        "png"
    } else if ct.contains("jpeg") || ct.contains("jpg") {
        "jpg"
    } else if ct.contains("gif") {
        "gif"
    } else {
        "bin"
    };

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let filename = format!("upload_{}.{}", ts, ext);
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("uploaded_images");
    if let Err(e) = fs::create_dir_all(&dir) {
        return HttpResponse::InternalServerError().body(format!("Failed to create dir: {}", e));
    }
    let path = dir.join(&filename);

    match fs::write(&path, &body) {
        Ok(_) => {
            println!("Saved uploaded file: {:?}", path);
            HttpResponse::Ok().body(format!("Saved {}", filename))
        }
        Err(e) => HttpResponse::InternalServerError().body(format!("Failed to save: {}", e)),
    }
}

pub async fn run(config: Config) -> std::io::Result<()> {
    println!("Starting server at http://127.0.0.1:8080");
    let config_data = web::Data::new(config);
    HttpServer::new(move || {
        App::new()
            .app_data(config_data.clone())
            .service(index)
            .service(send)
            .service(upload)
            .service(actix_files::Files::new("/static", "frontend").show_files_listing())
    })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}
