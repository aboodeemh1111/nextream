import { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, CircularProgress } from '@mui/material';
import {
  MovieOutlined,
  PeopleOutline,
  PlayCircleOutline,
  TrendingUp
} from '@mui/icons-material';
import Chart from '../components/Chart';
import WidgetSm from '../components/WidgetSm';
import WidgetLg from '../components/WidgetLg';
import axios from 'axios';
import { useAuth } from '../context/authContext';

const API = axios.create({
  baseURL: 'http://localhost:8800/api'
});

const StatCard = ({ title, value, icon, color }) => (
  <Paper sx={{ p: 2 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box>
        <Typography color="textSecondary" variant="subtitle2" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4">
          {value}
        </Typography>
      </Box>
      <Box sx={{ 
        backgroundColor: `${color}15`, 
        p: 1, 
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center'
      }}>
        {icon}
      </Box>
    </Box>
  </Paper>
);

const Home = () => {
  const [stats, setStats] = useState({
    users: 0,
    movies: 0,
    views: 0,
    trending: 0
  });
  const [viewsData, setViewsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, viewsRes] = await Promise.all([
          API.get('/movies/stats', {
            headers: { token: `Bearer ${user.accessToken}` }
          }),
          API.get('/movies/views/monthly', {
            headers: { token: `Bearer ${user.accessToken}` }
          })
        ]);

        setStats(statsRes.data);
        setViewsData(viewsRes.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user.accessToken]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Subscribers"
            value={stats.users}
            icon={<PeopleOutline sx={{ color: '#1976d2' }} />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Movies"
            value={stats.movies}
            icon={<MovieOutlined sx={{ color: '#dc004e' }} />}
            color="#dc004e"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Views"
            value={stats.views}
            icon={<PlayCircleOutline sx={{ color: '#4caf50' }} />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Trending Now"
            value={stats.trending}
            icon={<TrendingUp sx={{ color: '#f57c00' }} />}
            color="#f57c00"
          />
        </Grid>

        {/* Monthly Views Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Monthly Views
            </Typography>
            <Chart
              data={viewsData}
              title="Video Views"
              dataKey="views"
              grid
            />
          </Paper>
        </Grid>

        {/* Recent Activity and Popular Content */}
        <Grid item xs={12} md={4}>
          <WidgetSm />
        </Grid>
        <Grid item xs={12} md={8}>
          <WidgetLg />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Home; 