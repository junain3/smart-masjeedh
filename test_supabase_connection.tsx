// Test Supabase Connection - Create this file and test

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://libwvftwbrewcxigwoal.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYnd2ZnR3YnJld2N4aWd3b2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NTA1OTAsImV4cCI6MjA4NzQyNjU5MH0.4PSDU9TP5k54tCC_EV12BoF54EKIqzXimkMnQMfKmXc';

const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection
async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test basic connection
    const { data, error } = await supabase.from('auth.users').select('count');
    
    if (error) {
      console.error('Connection error:', error);
    } else {
      console.log('Connection successful:', data);
    }
    
    // Test auth
    const { data: authData, error: authError } = await supabase.auth.getSession();
    console.log('Auth test:', authData, authError);
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}

// Run test
testConnection();
