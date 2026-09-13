// Helper file to re-export auth from the NextAuth route
// This is needed because auth is exported from the route file
export { auth } from '@/app/api/auth/[...nextauth]/route';
