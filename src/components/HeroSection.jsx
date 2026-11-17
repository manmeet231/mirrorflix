import React, { useState, useEffect, useRef } from 'react';
import HeroSlide from './HeroSlide';
import CarouselControls from './CarouselControls';
import './HeroSection.css';

const HeroSection = ({ 
  featuredShows = [], 
  autoPlayDelay = 7000,
  height = '85vh',
  showControls = true 
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const heroRef = useRef(null);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === featuredShows.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? featuredShows.length - 1 : prev - 1));
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Auto-progression
  useEffect(() => {
    if (isPaused || featuredShows.length <= 1) return;

    const interval = setInterval(() => {
      nextSlide();
    }, autoPlayDelay);

    return () => clearInterval(interval);
  }, [isPaused, autoPlayDelay, featuredShows.length]);

  // Handle mouse enter/leave for pause/resume
  const handleMouseEnter = () => {
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  // Handle touch events for mobile
  const handleTouchStart = () => {
    setIsPaused(true);
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
  };

  const heroStyle = {
    height: height
  };

  return (
    <section 
      className="hero" 
      ref={heroRef}
      style={heroStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="hero-container">
        {featuredShows.map((show, index) => (
          <HeroSlide 
            key={show.id} 
            show={show} 
            isActive={index === currentSlide}
          />
        ))}
      </div>
      
      {showControls && featuredShows.length > 1 && (
        <CarouselControls
          currentSlide={currentSlide}
          totalSlides={featuredShows.length}
          onPrev={prevSlide}
          onNext={nextSlide}
          onSlideClick={goToSlide}
        />
      )}
    </section>
  );
};

export default HeroSection;
