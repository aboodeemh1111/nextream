import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Avatar,
} from '@mui/material';
import { styled } from '@mui/material/styles';

const UserContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  margin: theme.spacing(2),
}));

const User = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();
        setUser(data);
        setFormData({
          username: data.username,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          address: data.address,
        });
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      navigate('/users');
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  if (loading) return <Typography>Loading...</Typography>;
  if (!user) return <Typography>User not found</Typography>;

  return (
    <UserContainer>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: 'center' }}>
            <Avatar
              src={user.avatar}
              sx={{ width: 100, height: 100, margin: '0 auto' }}
            />
            <Typography variant="h6" sx={{ mt: 2 }}>
              {user.username}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={8}>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="username"
                  label="Username"
                  value={formData.username}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="fullName"
                  label="Full Name"
                  value={formData.fullName}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="email"
                  label="Email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="phone"
                  label="Phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="address"
                  label="Address"
                  value={formData.address}
                  onChange={handleChange}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3 }}>
              <Button type="submit" variant="contained" color="primary">
                Update User
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </UserContainer>
  );
};

export default User; 