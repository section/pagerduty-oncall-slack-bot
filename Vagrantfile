# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty64"
  config.vm.provision "shell", inline: <<-SHELL
    curl --silent --location https://deb.nodesource.com/setup_4.x | bash -
    apt-get install --assume-yes nodejs python-pip
    npm install --global serverless
    pip install awscli
  SHELL
end
