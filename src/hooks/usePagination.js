import { useState, useCallback } from 'react';

export default function usePagination(defaultItemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState({});
  const [itemsPerPage] = useState(defaultItemsPerPage);

  const resetPagination = useCallback(() => {
    setCurrentPage({});
  }, []);

  const getPaginatedData = useCallback((data, dataType, page = 1) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [itemsPerPage]);

  const getTotalPages = useCallback((data) => {
    return Math.ceil(data.length / itemsPerPage);
  }, [itemsPerPage]);

  const getCurrentPageForData = useCallback((dataType, messageId) => {
    const key = messageId ? `${messageId}_${dataType}` : dataType;
    return currentPage[key] || 1;
  }, [currentPage]);

  const setCurrentPageForData = useCallback((dataType, page, messageId) => {
    const key = messageId ? `${messageId}_${dataType}` : dataType;
    setCurrentPage(prev => ({ ...prev, [key]: page }));
  }, []);

  return {
    currentPage,
    itemsPerPage,
    resetPagination,
    getPaginatedData,
    getTotalPages,
    getCurrentPageForData,
    setCurrentPageForData,
  };
}
