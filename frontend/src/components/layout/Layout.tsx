import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-background text-text-primary font-sans">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
