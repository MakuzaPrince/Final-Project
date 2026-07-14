import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Outlet } from 'react-router-dom';

const MainLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

    return (
        <div className="flex bg-gray-50 dark:bg-gray-900 min-h-screen">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
                <Navbar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
                <main className="flex-1 overflow-auto p-4 md:p-5">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
