import { useNavigate } from 'react-router-dom';

const UserList = () => {
  const navigate = useNavigate();

  const handleEdit = (id) => {
    navigate(`/user/${id}`);
  };

  // ... rest of component
}; 