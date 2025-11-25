
import React from 'react';

const AuthLayout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#2c3e50]">سیستم درخواست انتقال فایل</h1>
            <p className="text-gray-600 mt-2">{title}</p>
        </header>
        <main className="bg-white rounded-lg shadow-xl p-8">
            {children}
        </main>
      </div>
    </div>
  );
};

export default AuthLayout;
