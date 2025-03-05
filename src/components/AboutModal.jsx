import React from 'react';
import { X, Heart } from 'lucide-react';
import { Card } from '@/components/ui/card';

const AboutModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <Card className="w-full max-w-2xl bg-card p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          {/* About North Shore Beefs Section */}
          <section>
            <h2 className="text-2xl font-bold text-primary/90 mb-3">About North Shore Beefs</h2>
            <p className="text-muted-foreground leading-relaxed">
              North Shore Beefs started in 2018 as a community-driven platform for food enthusiasts 
              to share their experiences with glorious beefs across the North Shore. What began as a 
              small group of passionate foodies has grown into a vibrant community dedicated to 
              discovering and sharing the best beef experiences in our area.
            </p>
          </section>

          {/* About the Developer Section */}
          <section className="pt-4 border-t">
            <h2 className="text-2xl font-bold text-primary/90 mb-3">About the Developer</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Hi! I'm CJ, the developer behind North Shore Beefs app. As both a software engineer and 
              a food enthusiast, I created this platform to help our community discover and 
              share great beef experiences. If you enjoy using the app and would like to 
              support its continued development, you can buy me a coffee using the links below!
			  I made this out of my love of beefing for our community. GFY!
            </p>

            {/* Tip Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://venmo.com/xcessv"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-6 py-3 bg-[#008CFF] text-white rounded-lg hover:bg-[#0074D4] transition-colors"
              >
                <Heart className="w-5 h-5 mr-2" />
                Tip on Venmo
              </a>
              <a
                href="https://cash.app/$xcessv"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-6 py-3 bg-[#00D632] text-white rounded-lg hover:bg-[#00B82A] transition-colors"
              >
                <Heart className="w-5 h-5 mr-2" />
                Tip on Cash App
              </a>
            </div>
            
            {/* Last 4 digits notice */}
            <p className="text-sm text-muted-foreground text-center mt-3">
              Last 4 # : 3959
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
};

export default AboutModal;