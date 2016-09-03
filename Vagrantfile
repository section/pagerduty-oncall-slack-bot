# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty64"

  config.vm.provider "virtualbox" do |v|
    # `Serverless: Zipping service...` may get killed due to out-of-memory
    # TODO v.memory = 1024
    # or
    # sudo apt-get purge --assume-yes puppet chef
    # sudo /vagrant/configure-swapfile.sh
  end

  config.vm.provision "shell", inline: <<-SHELL
    curl --silent --location https://deb.nodesource.com/setup_4.x | bash -
    apt-get install --assume-yes nodejs python-pip
    npm install --global serverless
    pip install awscli
  SHELL
end
