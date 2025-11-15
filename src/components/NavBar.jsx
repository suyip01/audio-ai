import React from 'react';

const NavBar = ({ isMobile, isNavExpanded, setIsNavExpanded, user }) => {
  return (
    <>
      {isMobile && !isNavExpanded && (
        <div className="fixed top-6 left-6 z-50">
          <button
            onClick={() => setIsNavExpanded(!isNavExpanded)}
            className="w-12 h-12 bg-white/50 backdrop-blur-lg shadow-xl border border-white/30 rounded-xl flex items-center justify-center transition-all duration-300 hover:bg-white/70"
          >
            <i className="fas fa-bars text-emerald-700 text-lg transition-transform duration-300"></i>
          </button>
        </div>
      )}

      <div className={`fixed z-50 transition-all duration-[400ms] ${
        isMobile 
          ? `top-6 bottom-6 ${isNavExpanded ? 'left-6' : 'left-0'} ${isNavExpanded ? 'translate-x-0' : '-translate-x-full'}`
          : 'top-6 bottom-6 left-6'
      }`}>
        <div className={`backdrop-blur-lg shadow-xl border border-white/30 p-2 transition-all duration-[400ms] ${
          isMobile 
            ? 'bg-white/70 w-72 h-full rounded-3xl'
            : `bg-white/50 h-full ${isNavExpanded ? 'w-72 rounded-3xl' : 'w-14 rounded-2xl'}`
        }`}>
          <div className="flex flex-col justify-between h-full">
            <div className="flex flex-col space-y-4">
              {isMobile && isNavExpanded && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setIsNavExpanded(false)}
                    className="w-10 h-10 rounded-xl hover:bg-white/50 flex items-center justify-center transition-all duration-300"
                  >
                    <i className="fas fa-times text-emerald-700 text-lg"></i>
                  </button>
                </div>
              )}
              <button 
                onClick={() => window.location.href = '/'}
                className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 bg-gradient-to-br from-emerald-400/80 to-emerald-500/80 hover:from-emerald-500/90 hover:to-emerald-600/90 rounded-xl flex items-center transition-all duration-[400ms] shadow-lg hover:shadow-xl group relative overflow-hidden`}
                title="Back to Home"
              >
                <div className="flex items-center w-full">
                  <div className="w-10 flex justify-center flex-shrink-0">
                    <i className="fas fa-home text-white text-lg group-hover:scale-110 transition-transform"></i>
                  </div>
                  <span className={`text-white text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>首页</span>
                </div>
              </button>

              <button 
                onClick={() => {
                  if (isMobile) {
                    setIsNavExpanded(false);
                  } else {
                    setIsNavExpanded(!isNavExpanded);
                  }
                }}
                className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 rounded-xl hover:bg-white flex items-center transition-all duration-[400ms] hover:shadow-xl group relative overflow-hidden`}
                title="Chat"
              >
                <div className="flex items-center w-full">
                  <div className="w-10 flex justify-center flex-shrink-0">
                    <i className="fas fa-comment text-emerald-700 text-lg group-hover:scale-110 transition-transform"></i>
                  </div>
                  <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>聊天</span>
                </div>
              </button>

              <button 
                onClick={() => {
                  if (isMobile) {
                    setIsNavExpanded(false);
                  } else {
                    setIsNavExpanded(!isNavExpanded);
                  }
                }}
                className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 rounded-xl hover:bg-white flex items-center transition-all duration-[400ms] hover:shadow-xl group relative overflow-hidden`}
                title="Conversation History"
              >
                <div className="flex items-center w-full">
                  <div className="w-10 flex justify-center flex-shrink-0">
                    <i className="fas fa-history text-emerald-700 text-lg group-hover:scale-110 transition-transform"></i>
                  </div>
                  <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>聊天记录</span>
                </div>
              </button>

              <button 
                onClick={() => {
                  if (isMobile) {
                    setIsNavExpanded(false);
                  } else {
                    setIsNavExpanded(!isNavExpanded);
                  }
                }}
                className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 rounded-xl hover:bg-white flex items-center transition-all duration-[400ms] hover:shadow-xl group relative overflow-hidden`}
                title="Profile"
              >
                <div className="flex items-center w-full">
                  <div className="w-10 flex justify-center flex-shrink-0">
                    <i className="fas fa-user text-emerald-700 text-lg group-hover:scale-110 transition-transform"></i>
                  </div>
                  <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>个人资料</span>
                </div>
              </button>

              <button 
                onClick={() => {
                  if (isMobile) {
                    setIsNavExpanded(false);
                  } else {
                    setIsNavExpanded(!isNavExpanded);
                  }
                }}
                className={`${(isNavExpanded || isMobile) ? 'w-full' : 'w-10'} h-10 rounded-xl hover:bg-white flex items-center transition-all duration-[400ms] hover:shadow-xl group relative overflow-hidden`}
                title="Help"
              >
                <div className="flex items-center w-full">
                  <div className="w-10 flex justify-center flex-shrink-0">
                    <i className="fas fa-question-circle text-emerald-700 text-lg group-hover:scale-110 transition-transform"></i>
                  </div>
                  <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>帮助</span>
                </div>
              </button>
            </div>

            <div className="flex-1"></div>

            <div className="flex flex-col space-y-4">
              <div className="flex items-center">
                <button 
                  onClick={() => {
                    if (isMobile) {
                      setIsNavExpanded(false);
                    } else {
                      setIsNavExpanded(!isNavExpanded);
                    }
                  }}
                  className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-emerald-500/60 rounded-full flex items-center justify-center shadow-lg text-white font-semibold text-sm flex-shrink-0"
                  title={user ? `${user.name} (${user.email})` : '账户信息'}
                >
                  {user ? user.name?.charAt(0).toUpperCase() : 'U'}
                </button>
                <span className={`text-emerald-700 text-lg font-medium whitespace-nowrap ml-3 transition-all duration-[400ms] ${(isNavExpanded || isMobile) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>{user ? user.name : '账户信息'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isMobile && isNavExpanded && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsNavExpanded(false)}
        />
      )}
    </>
  );
};

export default NavBar;
