# provider and version

terraform {
 required_providers {
  aws = {
   source = "hashicorp/aws"
   version = "~> 5.0"
  }
 }
}

provider "aws" {
 region = var.aws_region 
}

variable "ssh_cidr" {
 type        = string
 description = "Your public IP/32 for SSH. Empty skips port 22."
 default     = ""
}

variable "aws_region" {
 type = string
 default = "us-west-2"
}

data "aws_vpc" "default" {
 default = true
}

data "aws_subnets" "default" {
 filter {
  name = "vpc-id"
  values = [data.aws_vpc.default.id]
 }
}

data "aws_ami" "al2023" {
 most_recent = true
 owners      = ["amazon"]
 filter {
  name = "name"
  values = ["al2023-ami-*-x86_64"]
 }
}

# Browser SSH from the EC2 console (Connect → EC2 Instance Connect).
data "aws_ec2_managed_prefix_list" "instance_connect" {
 name = "com.amazonaws.${var.aws_region}.ec2-instance-connect"
}

resource "aws_security_group" "staging" {
    name        = "todo-staging"
    description = "Staging web only"
    vpc_id      = data.aws_vpc.default.id
    ingress {
      description = "HTTP"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
    ingress {
      description = "HTTPS"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
    ingress {
      description     = "EC2 Instance Connect (console)"
      from_port       = 22
      to_port         = 22
      protocol        = "tcp"
      prefix_list_ids = [data.aws_ec2_managed_prefix_list.instance_connect.id]
    }
    dynamic "ingress" {
      for_each = var.ssh_cidr != "" ? [var.ssh_cidr] : []
      content {
        description = "SSH"
        from_port   = 22
        to_port     = 22
        protocol    = "tcp"
        cidr_blocks = [ingress.value]
      }
    }
    egress {
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
    }
}


resource "aws_instance" "staging" {
    ami           = data.aws_ami.al2023.id
    instance_type = "t3.small"
    subnet_id     = data.aws_subnets.default.ids[0]
    vpc_security_group_ids = [aws_security_group.staging.id]
    associate_public_ip_address = true
    user_data = <<-EOF
      #!/bin/bash
      dnf install -y docker
      systemctl enable --now docker
      usermod -aG docker ec2-user
    EOF
    tags = { Name = "todo-staging" }
}

resource "aws_eip" "staging" {
    instance = aws_instance.staging.id
    domain   = "vpc"
}
  
output "public_ip" {
    value = aws_eip.staging.public_ip
}
