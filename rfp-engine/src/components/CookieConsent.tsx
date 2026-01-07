"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  hasConsentBeenGiven,
  acceptAllCookies,
  rejectNonEssentialCookies,
  setCustomCookiePreferences,
  initializeAnalyticsIfConsented,
} from "@/lib/cookies";

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    preferences: false,
    analytics: false,
  });

  useEffect(() => {
    // Check if consent has already been given
    if (!hasConsentBeenGiven()) {
      setShowBanner(true);
    } else {
      // If consent was given, initialize analytics if allowed
      initializeAnalyticsIfConsented();
    }
  }, []);

  const handleAcceptAll = async () => {
    acceptAllCookies();
    setShowBanner(false);
    initializeAnalyticsIfConsented();

    // Log consent to server
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentType: "cookies",
          granted: true,
          preferences: { essential: true, preferences: true, analytics: true },
        }),
      });
    } catch {
      // Silently fail - consent is still stored locally
    }
  };

  const handleRejectNonEssential = async () => {
    rejectNonEssentialCookies();
    setShowBanner(false);

    // Log consent to server
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentType: "cookies",
          granted: true,
          preferences: { essential: true, preferences: false, analytics: false },
        }),
      });
    } catch {
      // Silently fail
    }
  };

  const handleSavePreferences = async () => {
    setCustomCookiePreferences(preferences);
    setShowBanner(false);
    setShowPreferences(false);
    initializeAnalyticsIfConsented();

    // Log consent to server
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentType: "cookies",
          granted: true,
          preferences: { essential: true, ...preferences },
        }),
      });
    } catch {
      // Silently fail
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg">
      <div className="max-w-6xl mx-auto p-4">
        {!showPreferences ? (
          // Main banner view
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Cookie Preferences</h3>
              <p className="text-sm text-gray-600">
                We use cookies to enhance your experience, analyze site traffic, and for marketing purposes.
                By clicking &quot;Accept All&quot;, you consent to our use of cookies.{" "}
                <Link href="/cookies" className="text-blue-600 hover:underline">
                  Learn more
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowPreferences(true)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Manage Preferences
              </button>
              <button
                onClick={handleRejectNonEssential}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Reject Non-Essential
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          // Preferences view
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Cookie Preferences</h3>
              <button
                onClick={() => setShowPreferences(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close preferences"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Essential Cookies - Always enabled */}
              <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Essential Cookies</h4>
                  <p className="text-sm text-gray-600">
                    Required for the website to function. Cannot be disabled.
                  </p>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">Always On</span>
                  <div className="w-10 h-6 bg-blue-600 rounded-full p-1 cursor-not-allowed">
                    <div className="w-4 h-4 bg-white rounded-full translate-x-4"></div>
                  </div>
                </div>
              </div>

              {/* Preference Cookies */}
              <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Preference Cookies</h4>
                  <p className="text-sm text-gray-600">
                    Remember your settings and preferences for a better experience.
                  </p>
                </div>
                <button
                  onClick={() => setPreferences(p => ({ ...p, preferences: !p.preferences }))}
                  className={`w-10 h-6 rounded-full p-1 transition-colors ${
                    preferences.preferences ? "bg-blue-600" : "bg-gray-300"
                  }`}
                  role="switch"
                  aria-checked={preferences.preferences}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      preferences.preferences ? "translate-x-4" : "translate-x-0"
                    }`}
                  ></div>
                </button>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Analytics Cookies</h4>
                  <p className="text-sm text-gray-600">
                    Help us understand how you use our website to improve it.
                  </p>
                </div>
                <button
                  onClick={() => setPreferences(p => ({ ...p, analytics: !p.analytics }))}
                  className={`w-10 h-6 rounded-full p-1 transition-colors ${
                    preferences.analytics ? "bg-blue-600" : "bg-gray-300"
                  }`}
                  role="switch"
                  aria-checked={preferences.analytics}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      preferences.analytics ? "translate-x-4" : "translate-x-0"
                    }`}
                  ></div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowPreferences(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreferences}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
