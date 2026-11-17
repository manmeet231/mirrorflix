import React, { useState } from 'react';
import styled from '@emotion/styled';

const EnhancedMovieCard = ({ movie, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <CardContainer 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      isHovered={isHovered}
      onClick={onClick}
    >
      <PosterImage 
        src={movie.poster} 
        alt={movie.title} 
        isHovered={isHovered}
      />
      
      {isHovered && (
        <OverlayContainer>
          <GradientOverlay />
          
          <ActionButtons>
            <PlayButton>
              <PlayIcon />
            </PlayButton>
            <AddToListButton>
              <PlusIcon />
            </AddToListButton>
            <LikeButton>
              <ThumbsUpIcon />
            </LikeButton>
            <ExpandButton>
              <ChevronDownIcon />
            </ExpandButton>
          </ActionButtons>
          
          <MetadataRow>
            <MatchPercentage>{movie.matchPercentage}</MatchPercentage>
            <AgeRatingBadge>{movie.ageRating}</AgeRatingBadge>
            <SeasonsText>{movie.seasons}</SeasonsText>
            <HDBadge>HD</HDBadge>
          </MetadataRow>
          
          <TagsRow>
            {movie.tags.map((tag, index) => (
              <React.Fragment key={index}>
                <TagText>{tag}</TagText>
                {index < movie.tags.length - 1 && <TagBullet>•</TagBullet>}
              </React.Fragment>
            ))}
          </TagsRow>
        </OverlayContainer>
      )}
    </CardContainer>
  );
};

// Styled components
const CardContainer = styled.div`
  flex: 0 0 auto;
  width: 250px;
  height: 300px;
  margin-right: 10px;
  cursor: pointer;
  transition: transform 0.3s ease;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  z-index:10;

  &:hover {
    transform: scale(1.05);
    z-index: 10;
  }
`;

const PosterImage = styled.img`
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
  transition: border 0.3s ease;

  ${props => props.isHovered && `
    border: 2px solid #E50914;
  `}
`;

const OverlayContainer = styled.div`
  position: relative;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const GradientOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100%;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.95) 0%,
    rgba(0, 0, 0, 0.8) 40%,
    rgba(0, 0, 0, 0.6) 70%,
    rgba(0, 0, 0, 0) 100%
  );
  z-index: -1;
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
`;

const PlayButton = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
`;

const AddToListButton = styled.button`
  width: 40px;
  height: 40px;
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
  width: 40px;
  height: 40px;
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

const ExpandButton = styled.button`
  width: 40px;
  height: 40px;
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

const MetadataRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const MatchPercentage = styled.span`
  color: #46d369;
  font-size: 14px;
  font-weight: 500;
`;

const AgeRatingBadge = styled.span`
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
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

const TagsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
`;

const TagText = styled.span`
  color: #b3b3b3;
  font-size: 12px;
`;

const TagBullet = styled.span`
  color: #b3b3b3;
  font-size: 12px;
`;

// Icon components
const PlayIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="black"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="white"
  >
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
);

const ThumbsUpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="white"
  >
    <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2l-.01-.01L23 10z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="white"
  >
    <path d="M7 10l5 5 5-5z" />
  </svg>
);

export default EnhancedMovieCard;