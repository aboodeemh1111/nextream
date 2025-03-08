import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Chart } from '../components/Chart';

const ProductContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  margin: theme.spacing(2),
}));

const Product = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    inStock: true,
    description: '',
  });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${productId}`);
        const data = await response.json();
        setProduct(data);
        setFormData({
          name: data.name,
          price: data.price,
          inStock: data.inStock,
          description: data.description,
        });
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({
      ...prev,
      [e.target.name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      navigate('/products');
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  if (loading) return <Typography>Loading...</Typography>;
  if (!product) return <Typography>Product not found</Typography>;

  return (
    <ProductContainer>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Chart data={product.sales} title="Sales Performance" />
        </Grid>
        <Grid item xs={12} md={4}>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="name"
                  label="Product Name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="price"
                  label="Price"
                  type="number"
                  value={formData.price}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="description"
                  label="Description"
                  multiline
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3 }}>
              <Button type="submit" variant="contained" color="primary">
                Update Product
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </ProductContainer>
  );
};

export default Product; 