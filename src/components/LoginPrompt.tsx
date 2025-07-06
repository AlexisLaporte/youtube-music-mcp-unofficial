'use client'

import React from 'react';
import { Music, Shield, Zap, CheckCircle, Star, ArrowRight, Users, TrendingUp, Award } from 'lucide-react';

interface LoginPromptProps {
  onConnect: () => void;
  error?: string;
}

export const LoginPrompt: React.FC<LoginPromptProps> = ({ onConnect, error }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Music className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">YouTube Music Manager</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">Fonctionnalités</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">Tarifs</a>
              <a href="#testimonials" className="text-slate-600 hover:text-slate-900 transition-colors">Témoignages</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.1),transparent_50%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight fade-in-up">
              Gérez vos playlists YouTube Music
              <span className="gradient-text block">comme un pro</span>
            </h1>
            
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed fade-in-up stagger-1">
              Organisez, synchronisez et optimisez votre bibliothèque musicale avec des outils professionnels conçus pour les mélomanes exigeants.
            </p>
            
            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-6 mb-10 fade-in-up stagger-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-slate-600">100% Sécurisé</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-slate-600">Instantané</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="text-sm text-slate-600">Gratuit</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={onConnect}
              className="saas-button-primary text-lg px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 inline-flex items-center gap-3 mb-6 fade-in-up stagger-3"
            >
              <span>Commencer gratuitement</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            
            <p className="text-slate-500 text-sm">
              Connexion sécurisée avec Google OAuth • Aucune carte bancaire requise
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Pourquoi choisir YouTube Music Manager ?
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Une suite complète d'outils pour transformer votre expérience musicale
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="saas-card p-8 text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-6">
                <Music className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Gestion Intelligente
              </h3>
              <p className="text-slate-600">
                Organisez automatiquement vos playlists selon vos préférences musicales avec notre IA intégrée
              </p>
            </div>

            {/* Feature 2 */}
            <div className="saas-card p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Synchronisation Temps Réel
              </h3>
              <p className="text-slate-600">
                Synchronisez instantanément vos modifications avec YouTube Music pour une expérience fluide
              </p>
            </div>

            {/* Feature 3 */}
            <div className="saas-card p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Sécurité Avancée
              </h3>
              <p className="text-slate-600">
                Vos données musicales sont protégées avec les plus hauts standards de sécurité et de confidentialité
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">50K+</div>
              <div className="text-slate-600">Utilisateurs actifs</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">2M+</div>
              <div className="text-slate-600">Playlists gérées</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">99.9%</div>
              <div className="text-slate-600">Temps de fonctionnement</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">4.9/5</div>
              <div className="text-slate-600">Note utilisateurs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div id="testimonials" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Ce que disent nos utilisateurs
            </h2>
            <p className="text-xl text-slate-600">
              Des milliers de mélomanes nous font confiance
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="saas-card p-8">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-slate-600 mb-6">
                "Cette plateforme a complètement transformé ma façon d'organiser ma musique. Interface intuitive et fonctionnalités puissantes."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Marie Dubois</p>
                  <p className="text-sm text-slate-500">Musicienne professionnelle</p>
                </div>
              </div>
            </div>

            <div className="saas-card p-8">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-slate-600 mb-6">
                "Enfin un outil qui comprend vraiment les besoins des DJ. La synchronisation est parfaite et les performances exceptionnelles."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Thomas Martin</p>
                  <p className="text-sm text-slate-500">DJ professionnel</p>
                </div>
              </div>
            </div>

            <div className="saas-card p-8">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-slate-600 mb-6">
                "Un service client exceptionnel et une plateforme qui évolue constamment. Je recommande vivement !"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Sophie Laurent</p>
                  <p className="text-sm text-slate-500">Productrice musicale</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <Music className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold">YouTube Music Manager</span>
              </div>
              <p className="text-slate-400 mb-6">
                La plateforme de référence pour gérer vos playlists YouTube Music de manière professionnelle et efficace.
              </p>
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-slate-700 cursor-pointer">
                  <span className="text-sm">X</span>
                </div>
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-slate-700 cursor-pointer">
                  <span className="text-sm">FB</span>
                </div>
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-slate-700 cursor-pointer">
                  <span className="text-sm">IN</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Tarifs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Conditions d'utilisation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Politique de confidentialité</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Mentions légales</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-slate-400">
            <p>&copy; 2024 YouTube Music Manager. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};