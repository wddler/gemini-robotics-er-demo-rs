use actix_web::{get, post, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Deserialize)]
struct SendRequest {
    #[serde(rename = "imageBase64")]
    image_base64: String,
    prompt: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DetectionPoint {
    point: [u32; 2],
    label: String,
}

#[get("/")]
async fn index() -> impl Responder {
    // Note: The path to index.html is relative to the Cargo.toml of the project.
    // This assumes you are running the web server from the root of your Rust project.
    let index_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("index.html");
    match fs::read_to_string(index_path) {
        Ok(body) => HttpResponse::Ok().content_type("text/html").body(body),
        Err(_) => HttpResponse::NotFound().body("404 Not Found: index.html not found"),
    }
}

#[post("/send")]
async fn send(req: web::Json<SendRequest>) -> impl Responder {
    let api_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
    if api_key.is_empty() {
        return HttpResponse::BadRequest().body("GEMINI_API_KEY environment variable not set");
    }

    let client = reqwest::Client::new();
    let gemini_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-robotics-er-1.5-preview:generateContent";

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
            "temperature": 0.5,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    });

    match client
        .post(gemini_url)
        .query(&[("key", api_key)])
        .json(&gemini_request)
        .send()
        .await
    {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(body) => {
                println!("Gemini response: {:?}", body);
                // Extract text from response
                if let Some(text) = body
                    .get("candidates")
                    .and_then(|c| c.get(0))
                    .and_then(|f| f.get("content"))
                    .and_then(|co| co.get("parts"))
                    .and_then(|p| p.get(0))
                    .and_then(|p| p.get("text"))
                    .and_then(|t| t.as_str())
                {
                    // Try to parse as JSON array
                    if let Ok(parsed) = serde_json::from_str::<Vec<DetectionPoint>>(text) {
                        return HttpResponse::Ok().json(parsed);
                    }
                    // If not valid JSON, return raw text
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    println!("Starting server at http://127.0.0.1:8080");
    HttpServer::new(|| App::new().service(index).service(send).service(upload))
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}