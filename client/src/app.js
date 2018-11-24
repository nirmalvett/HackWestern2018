import React, { Component } from 'react';
import './app.css';
import Test from './components/test';

class App extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Title</h1>
        </header>
        <Test />
      </div>
    );
  }
}

export default App;
