import React from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import MovieRow from './components/MovieRow';
import Footer from './components/Footer';
import './App.css';

const App = () => {
  // Featured shows for carousel
  const featuredShows = [
    {
      id: 1,
      title: "Stranger Things",
      description: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.",
      backgroundImage: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
    },
    {
      id: 2,
      title: "The Crown",
      description: "Follow the political rivalries and romance of Queen Elizabeth II's reign and the events that shaped the second half of the 20th century.",
      backgroundImage: "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
    },
    {
      id: 3,
      title: "Bridgerton",
      description: "In Regency London during the social season, ambitious young women and their mothers seek to capture the attention of eligible bachelors.",
      backgroundImage: "https://images.unsplash.com/photo-1618897996318-5a901fa6ca71?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
    },
    {
      id: 4,
      title: "The Witcher",
      description: "Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts.",
      backgroundImage: "https://images.unsplash.com/photo-1635805737707-575885ab0820?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
    },
    {
      id: 5,
      title: "Money Heist",
      description: "A group of robbers carry out a sophisticated heist on the Royal Mint of Spain, under the leadership of the mysterious Professor.",
      backgroundImage: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
    }
  ];

  // Sample movie data
  const movies = {
    trendingNow: [
      { id: 1, title: 'Movie 1', poster: 'https://picsum.photos/seed/movie1/200/300.jpg' },
      { id: 2, title: 'Movie 2', poster: 'https://picsum.photos/seed/movie2/200/300.jpg' },
      { id: 3, title: 'Movie 3', poster: 'https://picsum.photos/seed/movie3/200/300.jpg' },
      { id: 4, title: 'Movie 4', poster: 'https://picsum.photos/seed/movie4/200/300.jpg' },
      { id: 5, title: 'Movie 5', poster: 'https://picsum.photos/seed/movie5/200/300.jpg' },
      { id: 6, title: 'Movie 6', poster: 'https://picsum.photos/seed/movie6/200/300.jpg' },
      { id: 7, title: 'Movie 7', poster: 'https://picsum.photos/seed/movie7/200/300.jpg' },
      { id: 8, title: 'Movie 8', poster: 'https://picsum.photos/seed/movie8/200/300.jpg' },
      { id: 9, title: 'Movie 9', poster: 'https://picsum.photos/seed/movie9/200/300.jpg' },
      { id: 10, title: 'Movie 10', poster: 'https://picsum.photos/seed/movie10/200/300.jpg' },
      { id: 11, title: 'Movie 11', poster: 'https://picsum.photos/seed/movie11/200/300.jpg' },
      { id: 12, title: 'Movie 12', poster: 'https://picsum.photos/seed/movie12/200/300.jpg' },
    ],
    top10Movies: [
      { id: 13, title: 'Top Movie 1', poster: 'https://picsum.photos/seed/top1/200/300.jpg' },
      { id: 14, title: 'Top Movie 2', poster: 'https://picsum.photos/seed/top2/200/300.jpg' },
      { id: 15, title: 'Top Movie 3', poster: 'https://picsum.photos/seed/top3/200/300.jpg' },
      { id: 16, title: 'Top Movie 4', poster: 'https://picsum.photos/seed/top4/200/300.jpg' },
      { id: 17, title: 'Top Movie 5', poster: 'https://picsum.photos/seed/top5/200/300.jpg' },
      { id: 18, title: 'Top Movie 6', poster: 'https://picsum.photos/seed/top6/200/300.jpg' },
      { id: 19, title: 'Top Movie 7', poster: 'https://picsum.photos/seed/top7/200/300.jpg' },
      { id: 20, title: 'Top Movie 8', poster: 'https://picsum.photos/seed/top8/200/300.jpg' },
    ],
    actionMovies: [
      { id: 21, title: 'Action 1', poster: 'https://picsum.photos/seed/action1/200/300.jpg' },
      { id: 22, title: 'Action 2', poster: 'https://picsum.photos/seed/action2/200/300.jpg' },
      { id: 23, title: 'Action 3', poster: 'https://picsum.photos/seed/action3/200/300.jpg' },
      { id: 24, title: 'Action 4', poster: 'https://picsum.photos/seed/action4/200/300.jpg' },
      { id: 25, title: 'Action 5', poster: 'https://picsum.photos/seed/action5/200/300.jpg' },
      { id: 26, title: 'Action 6', poster: 'https://picsum.photos/seed/action6/200/300.jpg' },
      { id: 27, title: 'Action 7', poster: 'https://picsum.photos/seed/action7/200/300.jpg' },
      { id: 28, title: 'Action 8', poster: 'https://picsum.photos/seed/action8/200/300.jpg' },
    ],
    comedyMovies: [
      { id: 29, title: 'Comedy 1', poster: 'https://picsum.photos/seed/comedy1/200/300.jpg' },
      { id: 30, title: 'Comedy 2', poster: 'https://picsum.photos/seed/comedy2/200/300.jpg' },
      { id: 31, title: 'Comedy 3', poster: 'https://picsum.photos/seed/comedy3/200/300.jpg' },
      { id: 32, title: 'Comedy 4', poster: 'https://picsum.photos/seed/comedy4/200/300.jpg' },
      { id: 33, title: 'Comedy 5', poster: 'https://picsum.photos/seed/comedy5/200/300.jpg' },
      { id: 34, title: 'Comedy 6', poster: 'https://picsum.photos/seed/comedy6/200/300.jpg' },
      { id: 35, title: 'Comedy 7', poster: 'https://picsum.photos/seed/comedy7/200/300.jpg' },
      { id: 36, title: 'Comedy 8', poster: 'https://picsum.photos/seed/comedy8/200/300.jpg' },
    ],
    dramaMovies: [
      { id: 37, title: 'Drama 1', poster: 'https://picsum.photos/seed/drama1/200/300.jpg' },
      { id: 38, title: 'Drama 2', poster: 'https://picsum.photos/seed/drama2/200/300.jpg' },
      { id: 39, title: 'Drama 3', poster: 'https://picsum.photos/seed/drama3/200/300.jpg' },
      { id: 40, title: 'Drama 4', poster: 'https://picsum.photos/seed/drama4/200/300.jpg' },
      { id: 41, title: 'Drama 5', poster: 'https://picsum.photos/seed/drama5/200/300.jpg' },
      { id: 42, title: 'Drama 6', poster: 'https://picsum.photos/seed/drama6/200/300.jpg' },
      { id: 43, title: 'Drama 7', poster: 'https://picsum.photos/seed/drama7/200/300.jpg' },
      { id: 44, title: 'Drama 8', poster: 'https://picsum.photos/seed/drama8/200/300.jpg' },
    ],
  };

  return (
    <div className="app">
      <Navbar />
      <main>
        <HeroSection featuredShows={featuredShows} />
        <MovieRow title="Trending Now" movies={movies.trendingNow} />
        <MovieRow title="Top 10 Movies in India" movies={movies.top10Movies} />
        <MovieRow title="Action Movies" movies={movies.actionMovies} />
        <MovieRow title="Comedy Movies" movies={movies.comedyMovies} />
        <MovieRow title="Drama Movies" movies={movies.dramaMovies} />
      </main>
      <Footer />
    </div>
  );
};

export default App;
