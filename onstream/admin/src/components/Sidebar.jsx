import { Box, Drawer, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import {
  Home,
  Person,
  PlayCircleOutline,
  List as ListIcon,
  BarChart,
  Settings
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 240;

const menuItems = [
  { text: 'Home', icon: <Home />, path: '/' },
  { text: 'Users', icon: <Person />, path: '/users' },
  { text: 'Movies', icon: <PlayCircleOutline />, path: '/movies' },
  { text: 'Lists', icon: <ListIcon />, path: '/lists' },
  { text: 'Analytics', icon: <BarChart />, path: '/analytics' },
  { text: 'Settings', icon: <Settings />, path: '/settings' }
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', mt: 8 }}>
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.text}
              onClick={() => navigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                  },
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

export default Sidebar; 