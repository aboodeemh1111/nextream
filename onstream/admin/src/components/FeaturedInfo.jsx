import { styled } from '@mui/material/styles';
import { Paper, Typography, Box } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const FeaturedItem = styled(Paper)(({ theme }) => ({
  flex: 1,
  margin: theme.spacing(0, 2),
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  cursor: 'pointer',
  boxShadow: theme.shadows[3],
}));

const MoneyContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
}));

const FeaturedInfo = () => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
      <FeaturedItem>
        <Typography variant="subtitle1" color="text.secondary">
          Revenue
        </Typography>
        <MoneyContainer>
          <Typography variant="h4" sx={{ mr: 2 }}>
            $0
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
            -11.4 <ArrowDownwardIcon fontSize="small" />
          </Box>
        </MoneyContainer>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Compared to last month
        </Typography>
      </FeaturedItem>

      <FeaturedItem>
        <Typography variant="subtitle1" color="text.secondary">
          Sales
        </Typography>
        <MoneyContainer>
          <Typography variant="h4" sx={{ mr: 2 }}>
            $0
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
            -1.4 <ArrowDownwardIcon fontSize="small" />
          </Box>
        </MoneyContainer>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Compared to last month
        </Typography>
      </FeaturedItem>

      <FeaturedItem>
        <Typography variant="subtitle1" color="text.secondary">
          Cost
        </Typography>
        <MoneyContainer>
          <Typography variant="h4" sx={{ mr: 2 }}>
            $0
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
            +2.4 <ArrowUpwardIcon fontSize="small" />
          </Box>
        </MoneyContainer>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Compared to last month
        </Typography>
      </FeaturedItem>
    </Box>
  );
};

export default FeaturedInfo; 