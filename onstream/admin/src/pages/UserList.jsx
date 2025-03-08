import React, { useState, useEffect } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Paper, CircularProgress, IconButton, Avatar, Tooltip, Typography, Chip, Button } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/authContext';

// Create axios instance without baseURL
const API = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
});

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const columns = [
    {
      field: 'profilePic',
      headerName: 'Avatar',
      width: 60,
      renderCell: (params) => (
        <Avatar 
          src={params.row.profilePic || '/static/images/noavatar.png'} 
          alt={params.row.username}
        />
      ),
      sortable: false
    },
    { 
      field: 'username', 
      headerName: 'Username', 
      width: 130,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2">{params.value}</Typography>
          <Typography variant="caption" color="textSecondary">
            ID: {params.row._id.slice(-6)}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'email', 
      headerName: 'Email', 
      width: 200 
    },
    {
      field: 'isAdmin',
      headerName: 'Role',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Admin' : 'User'}
          color={params.value ? 'primary' : 'default'}
          size="small"
        />
      )
    },
    {
      field: 'createdAt',
      headerName: 'Join Date',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.isActive ? 'Active' : 'Inactive'}
          color={params.row.isActive ? 'success' : 'error'}
          size="small"
        />
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit User">
            <IconButton
              onClick={() => navigate(`/user/${params.row._id}`)}
              color="primary"
              size="small"
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton
              onClick={() => handleDelete(params.row._id)}
              color="error"
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await API.delete(`/users/${id}`, {
          headers: {
            token: `Bearer ${user.accessToken}`
          }
        });
        setUsers(users.filter(user => user._id !== id));
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        // Log the request attempt
        console.log('Attempting to fetch users...');

        const response = await API.get('/api/users', {
          headers: {
            token: `Bearer ${user.accessToken}`
          }
        });

        console.log('Response received:', response.data);

        if (response.data) {
          const formattedUsers = response.data.map(user => ({
            ...user,
            id: user._id,
            isActive: !user.isBanned
          }));
          setUsers(formattedUsers);
        }
      } catch (err) {
        console.error('Full error:', err);
        if (err.code === 'ERR_NETWORK') {
          setError('Server is not running. Please start the backend server.');
        } else {
          setError(`Error: ${err.response?.data?.message || err.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user.accessToken]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 600, width: '100%', p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            User Management
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="body2" color="textSecondary">
              Total Users: {users.length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Admins: {users.filter(user => user.isAdmin).length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Active: {users.filter(user => user.isActive).length}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/newUser')}
        >
          Add User
        </Button>
      </Box>

      <Paper sx={{ height: 500 }}>
        <DataGrid
          rows={users}
          columns={columns}
          pageSize={8}
          rowsPerPageOptions={[8, 16, 24]}
          disableSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none'
            }
          }}
        />
      </Paper>
    </Box>
  );
};

export default UserList; 