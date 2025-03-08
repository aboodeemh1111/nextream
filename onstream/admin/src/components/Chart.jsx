import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const ChartContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

function Chart({ title, data, dataKey, grid }) {
  return (
    <ChartContainer>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <div style={{ height: '300px', width: '100%' }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="name" stroke="#5550bd" />
            <YAxis />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="#5550bd"
              activeDot={{ r: 8 }}
            />
            <Tooltip />
            {grid && <CartesianGrid stroke="#e0dfdf" strokeDasharray="5 5" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}

export { Chart };
export default Chart; 