package org.example.fe_sep490;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;

@WebFilter("/*")
public class SpaForwardFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        String path = req.getRequestURI().substring(req.getContextPath().length());

        // Cho phép các API backend (/api/*) và các file tĩnh (/assets/*, *.js, *.css, *.svg, *.png, *.ico, index.html) đi qua bình thường
        if (path.startsWith("/api/")
                || path.equals("/api")
                || path.startsWith("/assets/")
                || path.equals("/")
                || path.equals("/index.html")
                || path.contains(".")) {
            chain.doFilter(request, response);
            return;
        }

        // Các route của React Router (SPA) như /login, /workspaces, /projects/20... sẽ forward về /index.html
        req.getRequestDispatcher("/index.html").forward(request, response);
    }
}
