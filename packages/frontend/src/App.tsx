import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Container } from '@mui/material'
import Header from './components/Header.tsx'
import Footer from './components/Footer.tsx'
import HomePage from './pages/HomePage.tsx'
import AboutPage from './pages/AboutPage.tsx'

const App: React.FC = () => {
  return (
    <div className="App">
      <Header />
      <Container component="main" sx={{ mt: 4, mb: 4, minHeight: '70vh' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Container>
      <Footer />
    </div>
  )
}

export default App