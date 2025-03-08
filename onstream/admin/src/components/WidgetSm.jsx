import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Button,
  CircularProgress
} from '@mui/material';
import { Visibility } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/authContext';

const API = axios.create({
  baseURL: 'http://localhost:8800/api'
});

const WidgetSm = () => {
  const [newUsers, setNewUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNewUsers = async () => {
      try {
        const res = await API.get('/users?new=true', {
          headers: {
            token: `Bearer ${user.accessToken}`
          }
        });
        setNewUsers(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchNewUsers();
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
        New Members
      </Typography>
      <List>
        {newUsers.map((user) => (
          <ListItem key={user._id}>
            <ListItemAvatar>
              <Avatar src={user.profilePic || '/noavatar.png'} />
            </ListItemAvatar>
            <ListItemText
              primary={user.username}
              secondary={`Joined ${new Date(user.createdAt).toLocaleDateString()}`}
            />
            <ListItemSecondaryAction>
              <Button
                size="small"
                startIcon={<Visibility />}
                onClick={() => navigate(`/user/${user._id}`)}
              >
                View
              </Button>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default WidgetSm; 