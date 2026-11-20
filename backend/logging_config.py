"""Logging configuration for the FastAPI application."""
import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler


def setup_logging(log_level="INFO", log_file="logs/sync.log") -> logging.Logger:
    """
    Set up logging with both file and console handlers.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to the log file
    
    Returns:
        Configured logger instance
    """
    # Ensure log directory exists
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Get log level
    level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Create logger
    logger = logging.getLogger("mirrorflix_backend")
    logger.setLevel(level)
    
    # Avoid duplicate handlers while still honoring a changed log level.
    if logger.handlers:
        for handler in logger.handlers:
            handler.setLevel(level)
        return logger

    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(detailed_formatter)
    logger.addHandler(console_handler)
    
    # File handler with rotation (max 5MB per file, keep 3 backups)
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=5 * 1024 * 1024,  # 5MB
        backupCount=3,
        encoding='utf-8'
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(detailed_formatter)
    logger.addHandler(file_handler)
    
    return logger


# Modules share this logger; main.py configures its handlers once.
logger = logging.getLogger("mirrorflix_backend")