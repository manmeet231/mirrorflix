import React, { useState } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import ContentSection from './components/ContentSection';
import Footer from './components/Footer';
import MovieModal from './components/MovieModal';
import { animeShow } from './components/animeData';
import './App.css';

const App = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Featured shows for carousel
  const featuredShows = [
    {
      id: 1,
      title: "Stranger Things",
      description: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.",
      backgroundImage: "src/assets/strangerthings.jpg"
    },
    {
      id: 2,
      title: "The Crown",
      description: "Follow the political rivalries and romance of Queen Elizabeth II's reign and the events that shaped the second half of the 20th century.",
      backgroundImage: "src/assets/thecrown.jpg"
    },
    {
      id: 3,
      title: "Bridgerton",
      description: "In Regency London during the social season, ambitious young women and their mothers seek to capture the attention of eligible bachelors.",
      backgroundImage: "src/assets/bridgerton.jpg"
    },
    {
      id: 4,
      title: "The Witcher",
      description: "Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts.",
      backgroundImage: "src/assets/thewitcher.jpg"
    },
    {
      id: 5,
      title: "Money Heist",
      description: "A group of robbers carry out a sophisticated heist on the Royal Mint of Spain, under the leadership of the mysterious Professor.",
      backgroundImage: "src/assets/moneyheist.jpg"
    }
  ];

  

  return (
    <div className="app">
      <Navbar />
      <main>
        <HeroSection featuredShows={featuredShows} />
        <ContentSection />
      </main>
      
      {/* Movie Modal */}
      <MovieModal 
        movie={animeShow} 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
      
      <Footer />
    </div>
  );
};
export default App;
