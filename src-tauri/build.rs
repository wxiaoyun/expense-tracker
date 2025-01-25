use std::env;

fn main() {
    let node_env = env::var("NODE_ENV").unwrap_or("development".to_string());
    if node_env == "development" {
        dotenv::from_filename("../.env").ok();
    }

    if let Ok(database_name) = env::var("SQLITE_DATABASE_NAME") {
        println!("cargo:rustc-env=SQLITE_DATABASE_NAME={}", database_name);
    } else {
        println!("cargo:warning=SQLITE_DATABASE_NAME is not set in the .env file.");
    }

    println!("cargo:rerun-if-changed=../.env");

    tauri_build::build()
}
