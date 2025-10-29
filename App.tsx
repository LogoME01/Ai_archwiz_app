import React, { useState, useEffect, useCallback } from 'react';
import type { GeneratedOutput, ImageFile } from './types';
import * as geminiService from './services/geminiService';
import * as openaiService from './services/openaiService';
import { MAX_UNDO_STEPS } from './constants';

import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, firebaseError, db } from './firebase';

import { CreateTab } from './components/CreateTab';
import { EnhanceTab } from './components/EnhanceTab';
import { ResultViewerModal } from './components/ResultViewerModal';
import { LastResultPreview } from './components/LastResultPreview';
import { MessageBox } from './components/MessageBox';
import { Spinner } from './components/Spinner';
import { Moon, Sun, GoogleIcon } from './components/Icons';
import { Button } from './components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/Card';

type View = 'create' | 'enhance';
type AiProvider = 'gemini' | 'openai';
type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [view, setView] = useState<View>('create');
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('light');

  // Firebase auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  // Enhance tab state
  const [inputImage, setInputImage] = useState<ImageFile | null>(null);
  const [overlayImage, setOverlayImage] = useState<ImageFile | null>(null);
  const [undoHistory, setUndoHistory] = useState<ImageFile[]>([]);

  // Result state
  const [generatedOutput, setGeneratedOutput] = useState<GeneratedOutput | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  useEffect(() => {
    if (firebaseError) {
      setError(`Authentication is unavailable: ${firebaseError}`);
    }
  
    if (auth && db) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setIsVerifying(true);
          setError(null);
          try {
            // Check if user is in the approved list in Firestore
            const userDocRef = doc(db, "approved_users", user.uid);
            const userDoc = await getDoc(userDocRef);
  
            if (userDoc.exists()) {
              // User is approved
              setCurrentUser(user);
            } else {
              // User is not approved
              setError("Your account does not have permission to access ArchAI Studio. Please contact the administrator.");
              await signOut(auth);
              setCurrentUser(null);
            }
          } catch (e) {
            console.error("Error verifying user access:", e);
            setError("An error occurred while verifying your access. Please try again.");
            await signOut(auth);
            setCurrentUser(null);
          } finally {
            setIsVerifying(false);
            setAuthLoading(false);
          }
        } else {
          // No user is signed in
          setCurrentUser(null);
          setAuthLoading(false);
          setIsVerifying(false);
        }
      });
      return () => unsubscribe();
    } else {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const userPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
      setTheme(savedTheme);
    } else if (userPrefersDark) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleSignIn = async () => {
    // Guard against sign-in attempts if Firebase isn't working.
    if (!auth) {
      setError(firebaseError ? `Authentication is unavailable: ${firebaseError}` : "Firebase is not configured correctly.");
      return;
    }
    setError(null);
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Authentication error:", error);
        setError("Failed to sign in. Please try again.");
    }
  };

  const handleSignOut = async () => {
    // Guard against sign-out attempts if Firebase isn't working.
    if (!auth) {
      setError(firebaseError ? `Authentication is unavailable: ${firebaseError}` : "Firebase is not configured correctly.");
      return;
    }
    setError(null);
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Sign out error:", error);
        setError("Failed to sign out.");
    }
  };
  
  const addImageToUndoHistory = useCallback((image: ImageFile | null) => {
    if (!image) return;
    setUndoHistory(prev => {
      const newHistory = [image, ...prev];
      if (newHistory.length > MAX_UNDO_STEPS) {
        return newHistory.slice(0, MAX_UNDO_STEPS);
      }
      return newHistory;
    });
  }, []);

  const handleSetInputImage = useCallback((file: ImageFile | null) => {
    addImageToUndoHistory(inputImage);
    setInputImage(file);
    // When a new base image is uploaded, clear the overlay
    setOverlayImage(null);
  }, [inputImage, addImageToUndoHistory]);

  const handleUndo = useCallback(() => {
    if (undoHistory.length > 0) {
      const [lastImage, ...rest] = undoHistory;
      setInputImage(lastImage);
      setUndoHistory(rest);
      setOverlayImage(null); // Reset overlay on undo
    }
  }, [undoHistory]);
  
  const handleApiCall = useCallback(async <T,>(apiCall: () => Promise<T>, onSuccess: (result: T) => void) => {
    if (!auth || !currentUser) {
        setError(firebaseError ? `Authentication is unavailable: ${firebaseError}` : "You must be signed in to perform this action.");
        return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`Starting API call with ${aiProvider}...`);
    try {
      const result = await apiCall();
      console.log("API call successful.");
      onSuccess(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error("API call failed:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [aiProvider, currentUser]);
  
  const handleCreateGenerate = useCallback((prompt: string, style: string, resolution: string) => {
    const apiCall = aiProvider === 'gemini' 
      ? () => geminiService.generateImageFromText(prompt)
      : () => openaiService.generateImageFromText(prompt);

    handleApiCall(
      apiCall,
      (outputImage) => {
        const result: GeneratedOutput = {
          type: 'create', prompt, style, resolution, outputImage, inputImage: null, overlayImage: null, maskImage: null,
        };
        setGeneratedOutput(result);
        setIsResultModalOpen(true);
      }
    );
  }, [handleApiCall, aiProvider]);

  const handleEnhanceProcess = useCallback((prompt: string, style: string, intensity: number, overlay: ImageFile | null, mask: ImageFile | null) => {
    if (!inputImage) return;

    const apiCall = aiProvider === 'gemini'
      ? () => geminiService.editImage(inputImage, prompt, overlay, intensity, mask)
      : () => openaiService.editImage(inputImage, prompt, overlay, intensity, mask);

    handleApiCall(
      apiCall,
      (outputImage) => {
        const result: GeneratedOutput = {
          type: 'enhance', prompt, style, inputImage: inputImage.base64, outputImage, overlayImage: overlay?.base64 || null, maskImage: mask?.base64 || null, intensity
        };
        setGeneratedOutput(result);
        setIsResultModalOpen(true);
      }
    );
  }, [handleApiCall, inputImage, aiProvider]);

  const handleRegenerate = useCallback(() => {
    if (!generatedOutput) return;
    setIsResultModalOpen(false);
    
    setTimeout(() => {
      if (generatedOutput.type === 'create') {
        handleCreateGenerate(generatedOutput.prompt, generatedOutput.style, generatedOutput.resolution || '1024x1024');
      } else {
        const overlayFile = generatedOutput.overlayImage ? { base64: generatedOutput.overlayImage, mimeType: 'image/png', name: 'overlay.png' } : null;
        const maskFile = generatedOutput.maskImage ? { base64: generatedOutput.maskImage, mimeType: 'image/png', name: 'mask.png' } : null;
        handleEnhanceProcess(generatedOutput.prompt, generatedOutput.style, generatedOutput.intensity || 50, overlayFile, maskFile);
      }
    }, 300); // delay to allow modal to close
  }, [generatedOutput, handleCreateGenerate, handleEnhanceProcess]);

  const handleContinueEditing = useCallback(() => {
    if (generatedOutput && generatedOutput.outputImage) {
      addImageToUndoHistory(inputImage);
      setInputImage({ base64: generatedOutput.outputImage, mimeType: 'image/png', name: 'edited-result.png' });
      setOverlayImage(null); // Clear overlay
      setView('enhance');
      setIsResultModalOpen(false);
    }
  }, [generatedOutput, inputImage, addImageToUndoHistory]);
  
  const handleSendToEnhance = useCallback(() => {
    if (generatedOutput && generatedOutput.type === 'create' && generatedOutput.outputImage) {
      // Start a new history in enhance tab
      setInputImage({
        base64: generatedOutput.outputImage,
        mimeType: 'image/png',
        name: 'generated-image.png'
      });
      setUndoHistory([]); // Clear undo history for the new image
      setOverlayImage(null);
      setView('enhance');
      setIsResultModalOpen(false);
    }
  }, [generatedOutput]);

  if (authLoading || isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Spinner className="h-8 w-8 text-accent" />
        <p className="mt-4 text-text-secondary">{isVerifying ? 'Verifying access...' : 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-text-primary">
      <header className="p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-30">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-serif text-accent">ArchAI Studio</h1>
          <div className="flex items-center gap-2 md:gap-4">
             <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <div className="flex items-center gap-1 p-1 bg-gray-200 dark:bg-surface rounded-lg">
               <button
                  onClick={() => setAiProvider('gemini')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${aiProvider === 'gemini' ? 'bg-surface shadow' : 'text-text-secondary'}`}
                >
                  Gemini
                </button>
                <button
                  onClick={() => setAiProvider('openai')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${aiProvider === 'openai' ? 'bg-surface shadow' : 'text-text-secondary'}`}
                >
                  ChatGPT (DALL-E)
                </button>
            </div>
            <nav className="hidden sm:flex items-center gap-2 p-1 bg-gray-200 dark:bg-surface rounded-lg">
              <button
                onClick={() => setView('create')}
                className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${view === 'create' ? 'bg-surface shadow' : 'text-text-secondary'}`}
              >
                Create
              </button>
              <button
                onClick={() => setView('enhance')}
                className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${view === 'enhance' ? 'bg-surface shadow' : 'text-text-secondary'}`}
              >
                Enhance / Edit
              </button>
            </nav>
            {currentUser ? (
              <div className="flex items-center gap-3">
                  <img src={currentUser.photoURL || undefined} alt={currentUser.displayName || 'User'} className="w-8 h-8 rounded-full border-2 border-accent" referrerPolicy="no-referrer" />
                  <Button variant="secondary" size="sm" onClick={handleSignOut} className="hidden md:inline-flex">Sign Out</Button>
              </div>
            ) : (
                <Button variant="primary" size="sm" onClick={handleSignIn}>
                    <GoogleIcon className="mr-2 -ml-1 h-5 w-5" />
                    Sign In
                </Button>
            )}
          </div>
        </div>
      </header>
      
       <nav className="sm:hidden flex items-center justify-center gap-2 p-2 border-b border-border bg-surface">
          <button
            onClick={() => setView('create')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${view === 'create' ? 'bg-accent text-text-inverse shadow' : 'text-text-secondary bg-background'}`}
          >
            Create
          </button>
          <button
            onClick={() => setView('enhance')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${view === 'enhance' ? 'bg-accent text-text-inverse shadow' : 'text-text-secondary bg-background'}`}
          >
            Enhance / Edit
          </button>
      </nav>

      <main className="container mx-auto p-4 md:p-8">
        {error && <div className="mb-4"><MessageBox message={error} onDismiss={() => setError(null)} /></div>}
        <div className="mt-4">
          {currentUser ? (
            view === 'create' ? (
                <CreateTab onGenerate={handleCreateGenerate} isLoading={isLoading} aiProvider={aiProvider} />
            ) : (
                <EnhanceTab
                onProcess={handleEnhanceProcess}
                isLoading={isLoading}
                inputImage={inputImage}
                setInputImage={handleSetInputImage}
                overlayImage={overlayImage}
                setOverlayImage={setOverlayImage}
                undoHistoryCount={undoHistory.length}
                handleUndo={handleUndo}
                onError={setError}
                aiProvider={aiProvider}
                />
            )
          ) : (
            <Card className="text-center p-8 max-w-lg mx-auto mt-10">
                <CardHeader>
                    <CardTitle className="text-2xl font-serif">Welcome to ArchAI Studio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-text-secondary">Your AI-powered partner for architectural visualization.</p>
                    <p>Please sign in with your Google account to create, enhance, and edit your designs.</p>
                    <Button onClick={handleSignIn} size="lg">
                        <GoogleIcon className="mr-2 h-5 w-5" />
                        Sign In with Google
                    </Button>
                </CardContent>
            </Card>
          )}
        </div>
      </main>

      <ResultViewerModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        result={generatedOutput}
        onRegenerate={handleRegenerate}
        onContinueEditing={handleContinueEditing}
        onSendToEnhance={handleSendToEnhance}
      />
      
      {!isResultModalOpen && (
        <LastResultPreview
          lastResult={generatedOutput}
          onOpenModal={() => setIsResultModalOpen(true)}
        />
      )}
    </div>
  );
};

export default App;