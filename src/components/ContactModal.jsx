import React from 'react';
import { X, Facebook, Mail, Globe, ShoppingBag } from 'lucide-react';
import { Card } from '@/components/ui/card';

const ContactModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg bg-card p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-[#333333] rounded-full"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-white">Contact Us</h2>
        
        <div className="space-y-6">
          {/* Facebook Group */}
          <a 
            href="https://www.facebook.com/groups/1178870578918525" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-3 p-4 bg-[#1b2937] hover:bg-[#243447] rounded-lg transition-colors"
          >
            <Facebook className="w-6 h-6 text-[#4267B2]" />
            <div>
              <div className="font-medium text-white">Join Our Facebook Group</div>
              <div className="text-sm text-gray-400">Connect with the North Shore Beefs community</div>
            </div>
          </a>

          {/* Admin Email */}
          <a 
            href="mailto:fergsemail"
            className="flex items-center space-x-3 p-4 bg-[#333333] hover:bg-[#444444] rounded-lg transition-colors"
          >
            <Mail className="w-6 h-6 text-[#8b0000]" />
            <div>
              <div className="font-medium text-white">Contact Ferg (Admin)</div>
              <div className="text-sm text-gray-400">Need to enter fergs email</div>
            </div>
          </a>

          {/* Developer Email */}
          <a 
            href="mailto:racki.cj@gmail.com"
            className="flex items-center space-x-3 p-4 bg-[#333333] hover:bg-[#444444] rounded-lg transition-colors"
          >
            <Mail className="w-6 h-6 text-[#8b0000]" />
            <div>
              <div className="font-medium text-white">Contact Developer</div>
              <div className="text-sm text-gray-400">racki.cj@gmail.com</div>
            </div>
          </a>

          <div className="grid grid-cols-2 gap-4">
            {/* Main Website */}
            <a 
              href="https://northshorebeefs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 p-4 bg-[#333333] hover:bg-[#444444] rounded-lg transition-colors"
            >
              <Globe className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-white">Website</span>
            </a>

            {/* Merch Store */}
            <a 
              href="https://www.northshorebeefsmerch.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 p-4 bg-[#333333] hover:bg-[#444444] rounded-lg transition-colors"
            >
              <ShoppingBag className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-white">Merch Store</span>
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ContactModal;