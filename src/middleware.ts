import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // If the user is authenticated, continue
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/my-entities/:path*",
    "/my-interests/:path*",
    "/my-invites/:path*",
    "/my-backings/:path*",
    "/claim-entity/:path*",
  ],
};
