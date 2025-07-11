# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-06-20

### Fixed
- Ability to edit the name field.
- Toast now displays the message correctly.
- Dashboard loading issue.
- Command-line arguments can now be used for execution instead of `run.yml`.
- Errors no longer get duplicated if another test case is running.
- Homepage no longer reloads constantly.

## [Unreleased]

### Added
- Pre-commit hooks configuration with ruff (check and format) for backend Python code and ESLint for frontend JavaScript/TypeScript (using pnpm)
