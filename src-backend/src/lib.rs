// Library facade for integration tests.
//
// Exposes the application's modules so integration tests in `tests/` can
// construct the router and exercise endpoints without starting a TCP listener.

pub mod app;
pub mod db;
pub mod error;
pub mod routes;
pub mod services;
pub mod state;

// Rust guideline compliant 2026-02-21
