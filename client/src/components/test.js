import React, { Component } from 'react';
import './test.css';

class Test extends Component {

    constructor(props) {
        super(props);
        this.state = {
            test: []
        };
    }

    componentDidMount() {
        fetch('/api/test')
            .then(res => res.json())
            .then(test => this.setState({test}, () => console.log('Test call completed...', test)));
    }

    render() {
        return (
            <div>
                <h2>Test</h2>
                <ul>
                    {this.state.test.map(test =>
                        <li key={test.id}>{test.key}</li>
                    )}
                </ul>
            </div>
        );
    }

}

export default Test;
