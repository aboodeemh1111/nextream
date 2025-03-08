import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import { PlayArrow, Info } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/authContext';

const API = axios.create({
  baseURL: 'http://localhost:8800/api'
});

const WidgetLg = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTrendingMovies = async () => {
      try {
        const res = await API.get('/movies/trending', {
          headers: {
            token: `Bearer ${user.accessToken}`
          }
        });
        setMovies(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrendingMovies();
  }, [user.accessToken]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Trending Content
      </Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Content</TableCell>
              <TableCell>Genre</TableCell>
              <TableCell>Views</TableCell>
              <TableCell>Rating</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {movies.map((movie) => (
              <TableRow key={movie._id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      variant="rounded"
                      src={movie.thumbnail}
                      alt={movie.title}
                      sx={{ width: 48, height: 48 }}
                    />
                    <Box>
                      <Typography variant="subtitle2">
                        {movie.title}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {movie.year}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={movie.genre} 
                    size="small"
                    sx={{ backgroundColor: '#f3f4f6' }}
                  />
                </TableCell>
                <TableCell>
                  {movie.views.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                      {movie.rating.toFixed(1)}
                    </Typography>
                    <Chip
                      size="small"
                      label="★"
                      sx={{
                        backgroundColor: '#ffd700',
                        color: '#fff',
                        minWidth: 'unset'
                      }}
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={movie.isSeries ? 'Series' : 'Movie'}
                    color={movie.isSeries ? 'secondary' : 'primary'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Play">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => window.open(movie.trailer, '_blank')}
                    >
                      <PlayArrow />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Details">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/movie/${movie._id}`)}
                    >
                      <Info />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default WidgetLg; 