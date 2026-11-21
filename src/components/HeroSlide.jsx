import React from 'react';
import playButton from '../assets/playbutton.svg';
import './HeroSlide.css';
import playButton from '../assets/playbutton.svg';

const HeroSlide = ({ show, isActive, onSelectMovie }) => {
  return (
    <div className={`hero-slide ${isActive ? 'active' : ''}`}>
      <div 
        className="hero-background"
        style={{ 
          backgroundImage: `url(${show.backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="hero-overlay"></div>
      </div>
      <div className="hero-content">
        <h1 className="hero-title">{show.title}</h1>
        <p className="hero-description">
          {show.description}
        </p>
        <div className="hero-buttons">
          <button className="play-btn" onClick={() => onSelectMovie?.(show)}>
            <img
              src={playButton}
              alt="Play"
              className="play-icon"
            />
            Play
          </button>
          <button className="more-info-btn" onClick={() => onSelectMovie?.(show)}>
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
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
            More Info
          </button>
        </div>
      </div>
    </div>
  );
};

export default HeroSlide;
