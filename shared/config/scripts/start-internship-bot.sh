#!/usr/bin/env bash

# This script is used to start the internship-bot application using pm2.

pm2 start npm --name "internship-bot" -- run start:internship-bot