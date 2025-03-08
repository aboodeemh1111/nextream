import { AppBar, Toolbar, IconButton, Badge, Box } from '@mui/material';
import { NotificationsNone, Language, Settings } from '@mui/icons-material';
import { useAuth } from '../context/authContext';

const Topbar = () => {
  const { user } = useAuth();

  return (
    <AppBar position="sticky" sx={{ backgroundColor: 'white', color: 'inherit' }}>
      <Toolbar>
        <Box sx={{ flexGrow: 1 }}>
          <img 
            src="/static/images/logo.png" 
            alt="logo" 
            style={{ height: 40 }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/static/images/noavatar.png';
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <IconButton>
            <Badge badgeContent={4} color="error">
              <NotificationsNone />
            </Badge>
          </IconButton>
          <IconButton>
            <Language />
          </IconButton>
          <IconButton>
            <Settings />
          </IconButton>
          <Box 
            component="img"
            src={user?.profilePic || '/static/images/noavatar.png'}
            alt=""
            sx={{ 
              width: 40, 
              height: 40, 
              borderRadius: '50%', 
              cursor: 'pointer' 
            }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/static/images/noavatar.png';
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Topbar; 