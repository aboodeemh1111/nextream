import { useAuth } from "@/context/SimpleAuthContext";
import { useEffect } from "react";

function Dashboard() {
  const { isAuthenticated, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Redirect to login or handle unauthenticated state
      // You might want to use Next.js router here
    }
  }, [isAuthenticated, loading]);

  // Rest of your Dashboard component
  // ...
}

export default Dashboard;
