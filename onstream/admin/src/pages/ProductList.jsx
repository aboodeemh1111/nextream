import { useState, useEffect } from 'react';
import { useFirebase } from '../hooks/useFirebase';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import { where, orderBy, limit } from 'firebase/firestore';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const { getDocuments, deleteDocument, loading, error } = useFirebase();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const constraints = [
          where('active', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20)
        ];
        const data = await getDocuments('products', constraints);
        setProducts(data);
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };

    fetchProducts();
  }, [getDocuments]);

  const handleDelete = async (id) => {
    try {
      await deleteDocument('products', id);
      setProducts(products.filter(product => product.id !== id));
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Price</TableCell>
            <TableCell>Stock</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>${product.price}</TableCell>
              <TableCell>{product.stock}</TableCell>
              <TableCell>
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => handleDelete(product.id)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ProductList; 