import React from 'react';
import './CarouselControls.css';

const CarouselControls = ({ 
  currentSlide, 
  totalSlides, 
  onPrev, 
  onNext, 
  onSlideClick 
}) => {
  return (
    <div className="carousel-controls">
      <button className="carousel-nav-btn prev-btn" onClick={onPrev} aria-label="Previous slide">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
      </button>
      
      <div className="carousel-indicators">
        {Array.from({ length: totalSlides }).map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === currentSlide ? 'active' : ''}`}
            onClick={() => onSlideClick(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
      
      <button className="carousel-nav-btn next-btn" onClick={onNext} aria-label="Next slide">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
      </button>
    </div>
  );
};

export default CarouselControls;