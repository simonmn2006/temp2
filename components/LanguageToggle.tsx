
import React from 'react';
import { Language } from '../types';

interface LanguageToggleProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ currentLanguage, onLanguageChange }) => {
  return (
    <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
      <button
        onClick={() => onLanguageChange('de')}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
          currentLanguage === 'de' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        DE
      </button>
      <button
        onClick={() => onLanguageChange('en')}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
          currentLanguage === 'en' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        EN
      </button>
    </div>
  );
};
