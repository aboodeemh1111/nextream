import firebase from "firebase";

const firebaseConfig = {
  apiKey: "AIzaSyB91ogaobBfR_bflbdUjr8J_hHBkI7G_JI",
  authDomain: "onstream-6a46b.firebaseapp.com",
  projectId: "onstream-6a46b",
  storageBucket: "onstream-6a46b.appspot.com",
  messagingSenderId: "635674662728",
  appId: "1:635674662728:web:603b0f17a1e43fd096457d",
  measurementId: "G-Y6J312X406",
};

firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();
export default storage;
