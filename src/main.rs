use actix_web::{get, post, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

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
async fn send(body: web::Bytes) -> impl Responder {
    match std::str::from_utf8(&body) {
        Ok(s) => {
            println!("Received from client: {}", s);
            HttpResponse::Ok().body(format!("Server received: {}", s))
        }
        Err(_) => HttpResponse::BadRequest().body("Invalid request body"),
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
    println!("Starting server at http://127.0.0.1:8080");
    HttpServer::new(|| App::new().service(index).service(send).service(upload))
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}