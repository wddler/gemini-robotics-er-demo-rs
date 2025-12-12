use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use std::fs;
use std::path::Path;

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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Starting server at http://127.0.0.1:8080");
    HttpServer::new(|| App::new().service(index).service(send))
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}