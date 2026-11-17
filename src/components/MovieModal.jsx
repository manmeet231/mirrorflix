import React, { useState } from 'react';
import styled from '@emotion/styled';

const MovieModal = ({ movie, isOpen, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay isClosing={isClosing}>
      <ModalContainer isClosing={isClosing}>
        <CloseButton onClick={handleClose}>
          <CloseIcon />
        </CloseButton>
        
        <HeroSection>
          <HeroPoster src={movie.poster} alt={movie.title} />
          <HeroLogo />
          <HeroActionButtons>
            <PlayPillButton>
              <PlayIcon />
              <PlayText>Play</PlayText>
            </PlayPillButton>
            <AddToListButton>
              <PlusIcon />
            </AddToListButton>
            <LikeButton>
              <ThumbsUpIcon />
            </LikeButton>
          </HeroActionButtons>
        </HeroSection>
        
        <DetailsSection>
          <LeftColumn>
            <MetadataRow>
              <MatchPercentage>{movie.matchPercentage}</MatchPercentage>
              <YearText>{movie.year}</YearText>
              <SeasonsText>{movie.seasons}</SeasonsText>
              <HDBadge>HD</HDBadge>
            </MetadataRow>
            
            <RatingRow>
              <AgeRatingBadge>{movie.ageRating}</AgeRatingBadge>
              <GrayText>{movie.rating}</GrayText>
            </RatingRow>
            
            <SynopsisTitle>Synopsis</SynopsisTitle>
            <SynopsisText>{movie.synopsis}</SynopsisText>
            
            <AudioText>Japanese</AudioText>
          </LeftColumn>
          
          <RightColumn>
            <CastTitle>Cast</CastTitle>
            <CastText>{movie.cast}</CastText>
            
            <GenresTitle>Genres</GenresTitle>
            <GenresText>{movie.genres}</GenresText>
            
            <TagsTitle>This show is:</TagsTitle>
            <TagsText>{movie.tags.join(', ')}</TagsText>
          </RightColumn>
        </DetailsSection>
        
        <EpisodeListSection>
          <EpisodeListHeader>
            <EpisodeListTitle>Episodes</EpisodeListTitle>
            <SeasonDropdown>
              <SeasonDropdownText>Season 3 (12 EP)</SeasonDropdownText>
              <DropdownArrow />
            </SeasonDropdown>
          </EpisodeListHeader>
          
          <EpisodeRows>
            {movie.episodes.map((episode) => (
              <EpisodeRow key={episode.id}>
                <EpisodeThumbnail src={episode.thumbnail} alt={episode.title} />
                <EpisodeInfo>
                  <EpisodeTitle>{episode.title}</EpisodeTitle>
                  <EpisodeDescription>{episode.description}</EpisodeDescription>
                </EpisodeInfo>
                <EpisodeDuration>{episode.duration}</EpisodeDuration>
              </EpisodeRow>
            ))}
          </EpisodeRows>
        </EpisodeListSection>
      </ModalContainer>
    </ModalOverlay>
  );
};

// Styled components
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: ${props => props.isClosing ? 'fadeOut 0.3s ease' : 'fadeIn 0.3s ease'};
`;

const ModalContainer = styled.div`
  width: 80%;
  max-width: 900px;
  height: 85vh;
  background-color: #000000;
  border-radius: 8px;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
  animation: ${props => props.isClosing ? 'slideOut 0.3s ease' : 'slideIn 0.3s ease'};
  
  @media (max-width: 768px) {
    width: 95%;
    height: 95vh;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: rgba(22, 22, 22, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(22, 22, 22, 0.9);
  }
`;

const HeroSection = styled.div`
  position: relative;
  height: 50%;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.7) 100%);
`;

const HeroPoster = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  top: 0;
  left: 0;
`;

const HeroLogo = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  width: 120px;
  height: 40px;
  background: linear-gradient(to right, #00FFFF, #A020F0);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 18px;
`;

const HeroActionButtons = styled.div`
  position: absolute;
  bottom: 30px;
  left: 30px;
  display: flex;
  gap: 16px;
`;

const PlayPillButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #ffffff;
  color: black;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

const PlayText = styled.span``;

const AddToListButton = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: rgba(22, 22, 22, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(22, 22, 22, 0.9);
  }
`;

const LikeButton = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: rgba(22, 22, 22, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(22, 22, 22, 0.9);
  }
`;

const DetailsSection = styled.div`
  padding: 30px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 20px;
  }
`;

const LeftColumn = styled.div``;

const MetadataRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

const MatchPercentage = styled.span`
  color: #46d369;
  font-size: 14px;
  font-weight: 500;
`;

const YearText = styled.span`
  color: #b3b3b3;
  font-size: 14px;
`;

const SeasonsText = styled.span`
  color: #b3b3b3;
  font-size: 14px;
`;

const HDBadge = styled.span`
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
`;

const RatingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
`;

const AgeRatingBadge = styled.span`
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
`;

const GrayText = styled.span`
  color: #b3b3b3;
  font-size: 14px;
`;

const SynopsisTitle = styled.h3`
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const SynopsisText = styled.p`
  color: #ffffff;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 20px;
`;

const AudioText = styled.p`
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: #E50914;
  }
`;

const RightColumn = styled.div``;

const CastTitle = styled.h3`
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const CastText = styled.p`
  color: #b3b3b3;
  font-size: 14px;
  margin-bottom: 16px;
`;

const GenresTitle = styled.h3`
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const GenresText = styled.p`
  color: #b3b3b3;
  font-size: 14px;
  margin-bottom: 16px;
`;

const TagsTitle = styled.h3`
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const TagsText = styled.p`
  color: #b3b3b3;
  font-size: 14px;
`;

const EpisodeListSection = styled.div`
  padding: 0 30px 30px;
  border-top: 1px solid #333;
`;

const EpisodeListHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const EpisodeListTitle = styled.h2`
  color: #ffffff;
  font-size: 24px;
  font-weight: 700;
`;

const SeasonDropdown = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(22, 22, 22, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 4px;
  color: #b3b3b3;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(22, 22, 22, 0.9);
  }
`;

const SeasonDropdownText = styled.span``;

const EpisodeRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EpisodeRow = styled.div`
  display: flex;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
`;

const EpisodeThumbnail = styled.img`
  width: 120px;
  height: 68px;
  object-fit: cover;
  border-radius: 4px;
`;

const EpisodeInfo = styled.div`
  flex: 1;
`;

const EpisodeTitle = styled.h3`
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
`;

const EpisodeDescription = styled.p`
  color: #b3b3b3;
  font-size: 14px;
  line-height: 1.4;
`;

const EpisodeDuration = styled.span`
  color: #b3b3b3;
  font-size: 14px;
  align-self: center;
`;

// Icon components
const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="white"
  >
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const PlayIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="black"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="white"
  >
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
);

const ThumbsUpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="white"
  >
    <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2l-.01-.01L23 10z" />
  </svg>
);

const DropdownArrow = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="white"
  >
    <path d="M7 10l5 5 5-5z" />
  </svg>
);

export default MovieModal;