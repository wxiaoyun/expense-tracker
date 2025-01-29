use std::env;

fn main() {
    let tauri_env = env::var("TAURI_ENV").unwrap_or("local".to_string());
    if tauri_env == "local" {
        dotenv::from_filename("../.env").ok();
    }

    if let Ok(database_name) = env::var("SQLITE_DATABASE_NAME") {
        println!("cargo:rustc-env=SQLITE_DATABASE_NAME={}", database_name);
    } else {
        println!("cargo:warning=SQLITE_DATABASE_NAME is not set in the .env file.");
        println!("cargo:warning=Please export SQLITE_DATABASE_NAME in environment variable.");
    }

    println!("cargo:rerun-if-changed=../.env");

    tauri_build::build()
}
