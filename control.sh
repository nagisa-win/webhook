#!/bin/bash

# Webhook Server Management Script

set -e

APP_NAME="webhook-server"
SCRIPT_NAME="$(basename "$0")"

# Function to show usage
show_usage() {
    echo "Usage: $SCRIPT_NAME [start|stop|restart|status]"
    echo ""
    echo "Commands:"
    echo "  start   - Start the webhook server with PM2"
    echo "  stop    - Stop the webhook server"
    echo "  restart - Restart the webhook server"
    echo "  status  - Show server status"
    echo ""
    echo "If no command is provided, 'start' will be used by default."
}

# Function to check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo "📦 PM2 not found. Installing PM2..."
        npm install -g pm2
    fi
}

# Function to check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js first."
        exit 1
    fi
}

# Function to install dependencies
install_dependencies() {
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm install
    fi
}

# Function to start the server
start_server() {
    echo "🚀 Starting Webhook Server..."

    check_node
    check_pm2
    install_dependencies

    # Create logs directory
    mkdir -p logs
    # Create storage directory
    mkdir -p storage

    # Check if server is already running
    if pm2 list | grep -q "$APP_NAME"; then
        echo "⚠️  Server is already running. Use 'restart' to restart it."
        pm2 status "$APP_NAME"
        return 0
    fi

    # Start with PM2
    echo "🔄 Starting with PM2..."
    pm2 start pm2.config.cjs

    echo "✅ Webhook server started successfully!"
    echo "📊 Check status: $SCRIPT_NAME status"
    echo "📝 View logs: pm2 logs $APP_NAME"
    echo "🔧 Server running on http://localhost:8080"

    # Show PM2 status
    pm2 status "$APP_NAME"
}

# Function to stop the server
stop_server() {
    echo "🛑 Stopping Webhook Server..."

    check_pm2

    # Check if server is running
    if pm2 list | grep -q "$APP_NAME"; then
        pm2 delete "$APP_NAME"
        echo "✅ Webhook server stopped successfully!"
    else
        echo "ℹ️  Server is not running."
    fi
}

# Function to restart the server
restart_server() {
    echo "🔄 Restarting Webhook Server..."
    stop_server
    sleep 2
    start_server
}

# Function to show server status
show_status() {
    echo "📊 Webhook Server Status:"

    check_pm2

    if pm2 list | grep -q "$APP_NAME"; then
        pm2 status "$APP_NAME"
        echo ""
        echo "📝 Recent logs:"
        pm2 logs "$APP_NAME" --lines 10
    else
        echo "❌ Server is not running."
        echo "Use '$SCRIPT_NAME start' to start the server."
    fi
}

# Main script logic
case "${1:-start}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        start_server
        ;;
esac
